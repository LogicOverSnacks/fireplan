import { Selector, StateContext } from '@ngxs/store';

import { PlanAction } from '~/state/clients.state';
import { Plan, Scheme } from '../plans.state.model';
import { PlansState } from '../plans.state';

export class UpdateScheme {
  static readonly type = '[Scheme] UpdateScheme';
  constructor(public scheme: Scheme) {}
}

export class SchemeState {
  @Selector([PlansState.currentPlan])
  static scheme(plan: Plan) {
    return plan.scheme;
  }

  @PlanAction(UpdateScheme)
  updateScheme(ctx: StateContext<Plan>, action: UpdateScheme) {
    ctx.setState(plan => ({
      ...plan,
      scheme: action.scheme
    }));
  }
}
