/**
 * Non-tab Saved Trainers route — iter97 (#12).
 *
 * Profile → Saved Trainers → Back must return to Profile (not bounce to Home).
 * The "saved" entry under (tabs) loses navigation history when pushed from a
 * sibling tab, so the Profile screen now pushes to THIS route which lives in
 * the stack and supports router.back() reliably.
 */
import SavedScreen from './(tabs)/saved';
export default SavedScreen;
