function nonEmpty(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function resolveTransportFields(order) {
  const pe = order?.pendingEdit?.status === 'pending' ? order.pendingEdit : null;
  return {
    transport_name: String(pe?.transport_name ?? order?.transport_name ?? '').trim(),
    transport_location: String(pe?.transport_location ?? order?.transport_location ?? '').trim(),
    pincode: String(pe?.pincode ?? order?.pincode ?? '').trim(),
  };
}

function isTransportComplete(order) {
  const { transport_name, transport_location, pincode } = resolveTransportFields(order);
  return nonEmpty(transport_name) && nonEmpty(transport_location) && nonEmpty(pincode);
}

/** Merge existing DcOrder with incoming update payload for transport validation. */
function isTransportCompleteForUpdate(existing, body) {
  const merged = {
    transport_name: body?.transport_name !== undefined ? body.transport_name : existing?.transport_name,
    transport_location:
      body?.transport_location !== undefined ? body.transport_location : existing?.transport_location,
    pincode: body?.pincode !== undefined ? body.pincode : existing?.pincode,
    pendingEdit: existing?.pendingEdit,
  };
  return isTransportComplete(merged);
}

module.exports = {
  resolveTransportFields,
  isTransportComplete,
  isTransportCompleteForUpdate,
};
