import React from 'react';
import PaymentApprovalDetail from './PaymentApprovalDetail';

export default function PaymentApprovalPendingCashDetailScreen({ navigation, route }: any) {
  return <PaymentApprovalDetail kind="cash" navigation={navigation} route={route} />;
}
