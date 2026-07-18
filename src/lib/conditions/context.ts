// The evaluation context is passed IN to checkers, never read from inside them
// (roadmap §2, architectural requirement 2). Time needs only `now`; geo/weather will
// extend this shape with position/weather later, without changing the time checker.

export interface ConditionContext {
  now: Date;
  // later: position?: { lat: number; lng: number }; weather?: ...
}

export function currentContext(): ConditionContext {
  return { now: new Date() };
}
