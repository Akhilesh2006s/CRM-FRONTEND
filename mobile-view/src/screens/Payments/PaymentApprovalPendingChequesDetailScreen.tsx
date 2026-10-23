import React from 'react';
import PaymentApprovalDetail from './PaymentApprovalDetail';

export default function PaymentApprovalPendingChequesDetailScreen({ navigation, route }: any) {
  return <PaymentApprovalDetail kind="cheque" navigation={navigation} route={route} />;
}
