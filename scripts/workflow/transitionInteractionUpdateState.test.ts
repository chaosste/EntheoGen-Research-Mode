import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  transitionInteractionUpdateStateInFile,
  transitionInteractionUpdateStateInFileWithAudit
} from './transitionInteractionUpdateState';

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertRejects = async (fn: () => Promise<void>, message: string): Promise<void> => {
  let rejected = false;
  try {
    await fn();
  } catch {
    rejected = true;
  }
  assert(rejected, message);
};

const run = async (): Promise<void> => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'workflow-transition-test-'));

  try {
    const updatesPath = path.join(tempDir, 'interaction-updates.jsonl');

    const baseRecord = {
      update_id: 'u1',
      created_at: '2026-04-30T00:00:00.000Z',
      pair: ['a', 'b'],
      claim: 'test',
      source_refs: [{ source_id: 'source_gap', claim_support: 'none' }],
      requested_change: { 'classification.code': 'UNKNOWN' },
      rationale: 'test',
      status: 'proposed'
    };

    await writeFile(updatesPath, `${JSON.stringify(baseRecord)}\n`, 'utf8');

    const structuredTransition = await transitionInteractionUpdateStateInFileWithAudit({
      filePath: updatesPath,
      updateId: 'u1',
      to: 'structured',
      actor: 'workflow-test'
    });

    assert(structuredTransition.event_type === 'workflow_transition_applied', 'expected structured audit event type');
    assert(structuredTransition.item_id === 'u1', 'expected structured audit event item_id');
    assert(structuredTransition.workflow.from === 'submitted', 'expected structured audit event from-state');
    assert(structuredTransition.workflow.to === 'structured', 'expected structured audit event to-state');
    assert(structuredTransition.rationale.length > 0, 'expected transition audit rationale');

    const afterStructured = JSON.parse((await readFile(updatesPath, 'utf8')).trim()) as {
      workflow?: { state: string; transition_history: unknown[] };
    };

    assert(afterStructured.workflow?.state === 'structured', 'expected transition to structured');
    assert((afterStructured.workflow?.transition_history.length ?? 0) === 1, 'expected one transition history entry');

    await transitionInteractionUpdateStateInFile({
      filePath: updatesPath,
      updateId: 'u1',
      to: 'curator_review',
      actor: 'workflow-test'
    });

    const afterCurator = JSON.parse((await readFile(updatesPath, 'utf8')).trim()) as {
      workflow?: { state: string; transition_history: unknown[] };
    };

    assert(afterCurator.workflow?.state === 'curator_review', 'expected transition to curator_review');
    assert((afterCurator.workflow?.transition_history.length ?? 0) === 2, 'expected two transition history entries');

    await writeFile(updatesPath, `${JSON.stringify(baseRecord)}\n`, 'utf8');
    await transitionInteractionUpdateStateInFile({
      filePath: updatesPath,
      updateId: 'u1',
      to: 'safety_review',
      actor: 'workflow-test'
    });

    const forgedApprovedNoHistory = {
      ...baseRecord,
      workflow: {
        state: 'approved',
        transition_history: []
      }
    };

    await writeFile(updatesPath, `${JSON.stringify(forgedApprovedNoHistory)}\n`, 'utf8');
    await assertRejects(
      () =>
        transitionInteractionUpdateStateInFile({
          filePath: updatesPath,
          updateId: 'u1',
          to: 'published',
          actor: 'workflow-test'
        }),
      'forged state without workflow history must be rejected'
    );

    const forgedMismatchedHistory = {
      ...baseRecord,
      workflow: {
        state: 'approved',
        transition_history: [
          {
            from: 'submitted',
            to: 'structured',
            actor: 'forger',
            at: '2026-04-30T00:00:00.000Z'
          }
        ]
      }
    };

    await writeFile(updatesPath, `${JSON.stringify(forgedMismatchedHistory)}\n`, 'utf8');
    await assertRejects(
      () =>
        transitionInteractionUpdateStateInFile({
          filePath: updatesPath,
          updateId: 'u1',
          to: 'published',
          actor: 'workflow-test'
        }),
      'mismatched state and transition history must be rejected'
    );

    await writeFile(updatesPath, `${JSON.stringify(baseRecord)}\n`, 'utf8');
    await transitionInteractionUpdateStateInFile({
      filePath: updatesPath,
      updateId: 'u1',
      to: 'structured',
      actor: 'workflow-test'
    });
    await transitionInteractionUpdateStateInFile({
      filePath: updatesPath,
      updateId: 'u1',
      to: 'curator_review',
      actor: 'workflow-test'
    });
    await transitionInteractionUpdateStateInFile({
      filePath: updatesPath,
      updateId: 'u1',
      to: 'safety_review',
      actor: 'workflow-test'
    });
    await transitionInteractionUpdateStateInFile({
      filePath: updatesPath,
      updateId: 'u1',
      to: 'approved',
      actor: 'workflow-test'
    });

    await transitionInteractionUpdateStateInFile({
      filePath: updatesPath,
      updateId: 'u1',
      to: 'published',
      actor: 'workflow-test',
      note: 'Publication transition note'
    });

    const afterPublished = JSON.parse((await readFile(updatesPath, 'utf8')).trim()) as {
      workflow?: {
        state: string;
        transition_history: Array<{ to: string; note?: string }>;
      };
    };
    assert(afterPublished.workflow?.state === 'published', 'expected transition to published');
    const publishEntry = afterPublished.workflow?.transition_history.at(-1);
    assert(publishEntry?.to === 'published', 'expected publish transition entry');
    assert(
      publishEntry?.note === 'Publication transition note',
      'expected publish transition to retain note'
    );

    console.log('Interaction update workflow transition integration tests passed.');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
