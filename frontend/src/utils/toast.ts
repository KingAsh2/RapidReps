import Toast from 'react-native-toast-message';

// 4 toast styles: Success (green), Info (blue), Warning (orange), Error (red)
export const toast = {
  success: (message: string) => {
    Toast.show({ type: 'success', text1: message, visibilityTime: 3000, topOffset: 60 });
  },
  info: (message: string) => {
    Toast.show({ type: 'info', text1: message, visibilityTime: 3000, topOffset: 60 });
  },
  warning: (message: string) => {
    Toast.show({ type: 'info', text1: message, visibilityTime: 3500, topOffset: 60 });
  },
  error: (message: string) => {
    Toast.show({ type: 'error', text1: message, visibilityTime: 4000, topOffset: 60 });
  },
};
