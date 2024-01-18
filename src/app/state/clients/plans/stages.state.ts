import { Selector, StateContext } from '@ngxs/store';

import { PlanAction } from '~/state/clients.state';
import { Plan, Stage } from '../plans.state.model';
import { PlansState } from '../plans.state';

export class AddOrUpdateStage {
  static readonly type = '[Stages] AddOrUpdateStage';
  constructor(public stage: Stage, public insertAfterId: string | null) {}
}

export class DeleteStage {
  static readonly type = '[Stages] DeleteStage';
  constructor(public id: string) {}
}

export class UpdateStageEndYear {
  static readonly type = '[Stages] UpdateStageEndYear';
  constructor(public id: string, public year: number) {}
}

export class StagesState {
  @Selector([PlansState.currentPlan])
  static stages(plan: Plan) {
    return plan.stages.filter(stage => stage.endYear === undefined || stage.endYear > new Date().getUTCFullYear());
  }

  @Selector([PlansState.currentPlan])
  static finishedStages(plan: Plan) {
    return plan.stages.filter(stage => stage.endYear !== undefined && stage.endYear <= new Date().getUTCFullYear());
  }

  @PlanAction(AddOrUpdateStage)
  addOrUpdateStage(ctx: StateContext<Plan>, action: AddOrUpdateStage) {
    ctx.setState(plan => {
      const stages = plan.stages.filter(({ id }) => id !== action.stage.id);
      const index = stages.findIndex(({ id }) => id === action.insertAfterId) + 1;

      if (index >= stages.length - 1) {
        action.stage.endYear = undefined;
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

  @PlanAction(DeleteStage)
  deleteStage(ctx: StateContext<Plan>, action: DeleteStage) {
    ctx.setState(state => ({
      ...state,
      stages: state.stages.filter(({ id, deletable }) => !deletable || id !== action.id)
    }));
  }

  @PlanAction(UpdateStageEndYear)
  updateStageEndYear(ctx: StateContext<Plan>, action: UpdateStageEndYear) {
    ctx.setState(plan => {
      if (action.year <= new Date().getUTCFullYear()) return plan;

      const index = plan.stages.findIndex(({ id }) => id === action.id);
      if (index < 0 || index >= plan.stages.length - 1) return plan;

      const nextStage = plan.stages[plan.stages.length - 1];
      if (nextStage.endYear !== undefined && action.year >= nextStage.endYear) return plan;

      return {
        ...plan,
        stages: plan.stages.map(stage => stage.id === action.id
          ? { ...stage, endYear: action.year }
          : stage
        )
      };
    });
  }
}
