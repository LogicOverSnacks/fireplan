import { Selector, StateContext } from '@ngxs/store';

import { PlanAction } from '~/state/clients.state';
import { Plan, UnrolledPlan } from '../plans.state.model';
import { PlansState } from '../plans.state';
import { Stage, UnrolledStage } from './stages.state.model';

export class AddStage {
  static readonly type = '[Stages] AddStage';
  constructor(public stage: Stage, public insertAfterId: string | null) {}
}

export class PatchStage {
  static readonly type = '[Stages] PatchStage';
  constructor(public id: string, public stage: Omit<Partial<Stage>, 'id'>) {}
}

export class DeleteStage {
  static readonly type = '[Stages] DeleteStage';
  constructor(public id: string) {}
}

export class StagesState {
  @Selector([PlansState.currentPlan])
  static stages(plan: UnrolledPlan) {
    return plan.stages.filter(stage => stage.endYear === undefined || stage.endYear > new Date().getUTCFullYear());
  }

  @Selector([PlansState.currentPlan])
  static unrolledStages(plan: UnrolledPlan): UnrolledStage[] {
    if (plan.stages.length <= 0) return [];

    let previousStage = plan.stages[0] as UnrolledStage;
    const stages: UnrolledStage[] = [];

    for (let i = 0; i < plan.stages.length; i++) {
      const stage = plan.stages[i];
      previousStage = {
        id: stage.id,
        name: stage.name,
        deletable: stage.deletable,
        endYear: stage.endYear,
        incomeByPerson: {
          ...previousStage.incomeByPerson,
          ...stage.incomeByPerson
        },
        withdrawal: stage.withdrawal ?? previousStage.withdrawal,
        portfolioDistribution: {
          ...previousStage.portfolioDistribution,
          ...stage.portfolioDistribution
        },
        portfolioRedistributionFrequency: stage.portfolioRedistributionFrequency ?? previousStage.portfolioRedistributionFrequency
      };

      stages.push(previousStage);
    }

    return stages.filter(stage => stage.endYear === undefined || stage.endYear > new Date().getUTCFullYear());
  }

  @Selector([PlansState.currentPlan])
  static finishedStages(plan: UnrolledPlan) {
    return plan.stages.filter(stage => stage.endYear !== undefined && stage.endYear <= new Date().getUTCFullYear());
  }

  @PlanAction(AddStage)
  addStage(ctx: StateContext<Plan>, action: AddStage) {
    ctx.setState(plan => {
      if (plan.stages?.some(({ id }) => id === action.stage.id))
        throw new Error(`Stage ${action.stage.id} already exists`);

      const stages = [...(plan.stages ?? [])];
      const index = stages.findIndex(({ id }) => id === action.insertAfterId) + 1;

      if (index <= 0 && action.insertAfterId !== null)
        throw new Error(`Cannot add stage after stage ${action.insertAfterId} because it doesn't exist`);

      if (index > 0 && index < stages.length - 1) {
        const nextStage = stages[index + 1];
        if (action.stage.endYear === undefined)
          throw new Error(`Only the final stage can have a missing endYear`);
        if (action.stage.endYear <= new Date().getUTCFullYear())
          throw new Error(`Stage endYear must be in the future`);
        if (nextStage.endYear !== undefined && action.stage.endYear >= nextStage.endYear)
          throw new Error(`Stage endYear must be before the next stage's endYear`);
      } else if (index <= 0) {
        if (action.stage.endYear === undefined) {
          if (stages.length > 0)
            throw new Error(`Only the final stage can have a missing endYear`);
        } else {
          if (action.stage.endYear <= new Date().getUTCFullYear())
            throw new Error(`Stage endYear must be in the future`);

          if (stages.length > 0) {
            const nextStage = stages[index + 1];
            if (nextStage.endYear !== undefined && action.stage.endYear >= nextStage.endYear)
              throw new Error(`Stage endYear must be before the next stage's endYear`);
          }
        }
      } else {
        const previousStage = stages[index - 1];
        if (previousStage.endYear === undefined)
          previousStage.endYear = action.stage.endYear;

        action.stage.endYear = undefined;
      }

      if (index <= 0) {
        if (action.stage.incomeByPerson === undefined
          || action.stage.portfolioDistribution === undefined
          || action.stage.portfolioRedistributionFrequency === undefined
          || action.stage.withdrawal === undefined
        ) {
          throw new Error(`First stage cannot have missing parts`);
        }
      }

      return {
        ...plan,
        stages: [
          ...stages.slice(0, index),
          action.stage,
          ...stages.slice(index),
        ]
      };
    });
  }

  @PlanAction(PatchStage)
  patchStage(ctx: StateContext<Plan>, action: PatchStage) {
    ctx.setState(plan => {
      const index = plan.stages?.findIndex(({ id }) => id === action.id) ?? -1;
      if (!plan.stages || index < 0) throw new Error(`Cannot find stage ${action.id}`);

      if ('endYear' in action.stage) {
        if (action.stage.endYear !== undefined) {
          const previousStage = plan.stages[index - 1];
          const nextStage = plan.stages[index + 1];
          if (previousStage?.endYear && previousStage.endYear >= action.stage.endYear)
            throw new Error(`Stage endYear must be after the previous stage's`);
          if (nextStage?.endYear && nextStage.endYear <= action.stage.endYear)
            throw new Error(`Stage endYear must be before the next stage's`);
        } else if (index < plan.stages.length - 1) {
          throw new Error(`All but the last stage must have an endYear`);
        }
      }

      return plan.stages
        ? ({
          ...plan,
          stages: plan.stages.map(stage => stage.id === action.id
            ? { ...stage, ...action.stage }
            : stage
          )
        })
        : plan;
    });
  }

  @PlanAction(DeleteStage)
  deleteStage(ctx: StateContext<Plan>, action: DeleteStage) {
    ctx.setState(state => {
      if (!state.stages) return state;

      return {
        ...state,
        stages: state.stages.filter(({ id, deletable }) => !deletable || id !== action.id)
      };
    });
  }
}
