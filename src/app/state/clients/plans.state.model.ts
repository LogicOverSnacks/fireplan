import { Stage } from './plans/stages.state.model';

export type FullPlan = {
  inheritsFrom: null;
  name: string;
  stages: Stage[];
  initialPortfolioTotal: number;
};

export type PartialPlan = {
  inheritsFrom: string;
  name: string;
  stages?: Stage[];
  initialPortfolioTotal: number;
};

export type Plan = FullPlan | PartialPlan;

export type UnrolledPlan = {
  inheritsFrom: string | null;
  name: string;
  stages: Stage[];
  initialPortfolioTotal: number;
};
