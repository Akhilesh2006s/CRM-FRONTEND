import React from 'react';
import PaymentApprovalList from './PaymentApprovalList';

export default function PaymentApprovalPendingCashScreen({ navigation }: any) {
  return <PaymentApprovalList kind="cash" navigation={navigation} />;
}
