import React from 'react';
import PaymentApprovalList from './PaymentApprovalList';

export default function PaymentApprovalPendingChequesScreen({ navigation }: any) {
  return <PaymentApprovalList kind="cheque" navigation={navigation} />;
}
