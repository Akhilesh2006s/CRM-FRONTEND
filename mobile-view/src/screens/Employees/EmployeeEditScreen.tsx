import React from 'react';
import EmployeeNewScreen from './EmployeeNewScreen';

/**
 * Edit employee: the add-employee form in edit mode, so every detail entered at
 * creation (except the password) can be changed, including uploaded documents
 * and bank details. Route params: { id }.
 */
export default function EmployeeEditScreen(props: any) {
  return <EmployeeNewScreen key={props?.route?.params?.id} {...props} />;
}
