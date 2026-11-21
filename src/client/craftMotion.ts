export function turnToward(current: number, target: number, elapsedMs: number): number {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * (1 - Math.exp(-Math.max(0, elapsedMs) / 85));
}

export function courierPose(seconds: number, walking: boolean, greetingMs: number | null, attention: number, complete: boolean, reduced: boolean) {
  if (reduced) return { stride: 0, bodyY: 0, bodyX: 0, bodyZ: 0, leftArm: 0, rightArm: 0, raisedArm: 0, eyes: 1 };
  const stride = walking ? Math.sin(seconds * 13) * .42 : 0;
  const greeting = greetingMs !== null;
  const bow = greeting ? Math.sin(Math.min(1, greetingMs / 390) * Math.PI) : 0;
  const wave = greeting ? Math.min(1, Math.max(0, (greetingMs - 100) / 180)) : 0;
  const hop = greeting && complete ? Math.max(0, Math.sin(Math.min(1, Math.max(0, greetingMs - 430) / 520) * Math.PI)) : 0;
  const blink = seconds % 5.3;
  return {
    stride,
    bodyY: Math.abs(stride) * .035 + hop * .018 - attention * .010 + Math.sin(seconds * 1.8) * .0015,
    bodyX: walking ? .045 : bow * .12 + attention * .08,
    bodyZ: stride * .065,
    leftArm: -stride * .72 - attention * .15,
    rightArm: stride * .64 - bow * .18,
    raisedArm: wave * (2.35 + Math.sin(seconds * 11) * .16),
    eyes: blink > 5.12 && blink < 5.25 ? .12 : 1,
  };
}
