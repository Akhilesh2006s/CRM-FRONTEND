import React from 'react';
import ScreenShell from '../../ui/ScreenShell';
import { Card, EmptyState } from '../../ui/Kit';

export default function PlaceholderScreen({ route }: any) {
  const screenName = route?.name || 'Screen';

  return (
    <ScreenShell title={screenName}>
      <Card>
        <EmptyState icon="🚧" title="Coming Soon" message="This screen is under development and will be available soon." />
      </Card>
    </ScreenShell>
  );
}
