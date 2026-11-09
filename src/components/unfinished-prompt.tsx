import { Modal, StyleSheet, View } from 'react-native';

import { Button, Card, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { ActiveStatus } from '@/db/repository';

/**
 * Asked on launch when a workout has been open for hours: most likely the user forgot to
 * tap Finish. Saving ends it at the last ticked set, so the duration stays realistic.
 */
export function UnfinishedPrompt({
  status,
  hoursAgo,
  onResume,
  onFinish,
  onDiscard,
}: {
  status: ActiveStatus;
  hoursAgo: number;
  onResume: () => void;
  onFinish: () => void;
  onDiscard: () => void;
}) {
  const started = hoursAgo >= 24 ? `${Math.floor(hoursAgo / 24)} d ago` : `${hoursAgo} h ago`;
  return (
    <Modal transparent animationType="fade" onRequestClose={onResume}>
      <View style={styles.backdrop}>
        <Card style={styles.dialog}>
          <Txt variant="heading" style={{ textAlign: 'center' }}>
            Unfinished workout
          </Txt>
          <Txt tone="muted" style={{ textAlign: 'center' }}>
            {status.routineName ?? 'Workout'}, started {started} · {status.doneSets} of {status.totalSets} sets
            done. What do you want to do?
          </Txt>
          <Button title="Resume" onPress={onResume} />
          {status.doneSets > 0 && <Button title="Finish and save" variant="secondary" onPress={onFinish} />}
          <Button title="Discard workout" variant="ghost" onPress={onDiscard} />
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.lg },
  dialog: { gap: Spacing.md, maxWidth: 420, width: '100%', alignSelf: 'center' },
});
