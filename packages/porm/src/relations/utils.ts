import { Query, Relation } from 'pqb';

export const getThroughRelation = (model: Query, through: string) => {
  return (model.relations as Record<string, Relation>)[through];
};

export const getSourceRelation = (
  throughRelation: Relation,
  source: string,
) => {
  return (throughRelation.model.relations as Record<string, Relation>)[source];
};
