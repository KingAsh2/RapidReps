// Web shim for @stripe/stripe-react-native (native-only module)
// This file prevents web bundle crashes when native Stripe code is referenced
export const StripeProvider = ({ children }) => children;
export const useStripe = () => ({
  initPaymentSheet: async () => ({ error: { message: 'Stripe not available on web' } }),
  presentPaymentSheet: async () => ({ error: { message: 'Stripe not available on web' } }),
  createPaymentMethod: async () => ({ error: { message: 'Stripe not available on web' } }),
});
export const usePaymentSheet = () => ({});
export const CardField = () => null;
export default { StripeProvider, useStripe, usePaymentSheet, CardField };
