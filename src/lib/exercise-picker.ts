import { router } from 'expo-router';

/**
 * Lets the routine editor borrow the "Add exercise" modal: the editor registers what to do
 * with the chosen exercise, opens the modal in pick mode, and the modal hands the id back.
 * Kept outside React state because the two screens are separate routes.
 */
let onPicked: ((exerciseId: number) => void) | null = null;

export function pickExercise(alreadyAdded: number[], callback: (exerciseId: number) => void) {
  onPicked = callback;
  router.push({ pathname: '/pick-exercise', params: { mode: 'pick', exclude: alreadyAdded.join(',') } });
}

/** Called by the modal. Returns false when nobody is waiting (normal "add to workout" mode). */
export function deliverPick(exerciseId: number): boolean {
  if (!onPicked) return false;
  const callback = onPicked;
  onPicked = null;
  callback(exerciseId);
  return true;
}
