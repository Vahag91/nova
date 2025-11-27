let pendingAction = null;

export function setPendingPremiumAction(action) {
  if (typeof action === 'function') {
    pendingAction = action;
  } else {
    pendingAction = null;
  }
}

export function consumePendingPremiumAction() {
  const action = pendingAction;
  pendingAction = null;
  if (typeof action === 'function') {
    try {
      action();
      return true;
    } catch (error) {
      // Premium action error handled silently
    }
  }
  return false;
}

export function clearPendingPremiumAction() {
  pendingAction = null;
}
