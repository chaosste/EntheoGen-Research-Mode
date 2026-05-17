export const AGGREGATE_NODE_SPLITS = {
  mdma_2cx_dox_nbome: ['mdma', 'two_c_x', 'dox', 'nbome_series'],
  clonidine_guanfacine: ['clonidine', 'guanfacine'],
  beta_blockers_ccb: ['beta_blockers', 'calcium_channel_blockers']
} as const;

export type AggregateNodeId = keyof typeof AGGREGATE_NODE_SPLITS;

export const AGGREGATE_NODE_IDS = Object.keys(AGGREGATE_NODE_SPLITS) as AggregateNodeId[];

export const isAggregateNodeId = (id: string): id is AggregateNodeId =>
  Object.prototype.hasOwnProperty.call(AGGREGATE_NODE_SPLITS, id);

export const splitAggregateNode = (id: string): string[] =>
  (AGGREGATE_NODE_SPLITS[id as AggregateNodeId] ?? [id]).slice();

export const splitAggregatePair = (a: string, b: string): Array<[string, string]> => {
  const left = splitAggregateNode(a);
  const right = splitAggregateNode(b);
  const pairs: Array<[string, string]> = [];

  for (const leftId of left) {
    for (const rightId of right) {
      pairs.push([leftId, rightId]);
    }
  }

  return pairs;
};
