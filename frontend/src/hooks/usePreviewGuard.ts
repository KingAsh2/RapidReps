/**
 * usePreviewGuard — iter106an.
 *
 * When a trainee/trainer taps "Preview as Visitor" on their own profile, they
 * land on the public-facing screen (trainee/trainer-detail.tsx or
 * trainer/trainee-profile.tsx) with `?preview=1`. In preview, *every*
 * outgoing-side-effect CTA — Book Session, Message, Save, Report, Propose,
 * Accept, Decline, Quick Book, Subscribe, etc. — should be neutered so the
 * user doesn't accidentally message themselves, hit their own card, etc.
 *
 * Usage:
 *   const guard = usePreviewGuard();
 *   <Button onPress={guard(handleBook)} />
 *   // When in preview: shows a "Disabled in preview" toast, no-op otherwise.
 *
 *   const { inPreview, guard } = usePreviewGuard();
 *   {inPreview ? null : <Button onPress={...} />}
 */
import { useCallback, useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { toast } from '../utils/toast';

export function usePreviewGuard() {
  const params = useLocalSearchParams<{ preview?: string }>();
  const inPreview = params.preview === '1' || params.preview === 'true';

  const guard = useCallback(
    <F extends (...args: any[]) => any>(fn: F): F => {
      const wrapped = ((...args: any[]) => {
        if (inPreview) {
          toast.info('Disabled in preview · tap the banner to exit');
          return undefined;
        }
        return fn(...args);
      }) as F;
      return wrapped;
    },
    [inPreview],
  );

  return useMemo(() => ({ inPreview, guard }), [inPreview, guard]);
}

export default usePreviewGuard;
