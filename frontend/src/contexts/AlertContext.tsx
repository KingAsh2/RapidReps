import React, { createContext, useContext, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import AthleticAlert from '../components/AthleticAlert';

type AlertType = 'success' | 'error' | 'warning' | 'info';
type IconName = keyof typeof Ionicons.glyphMap;

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
  icon?: IconName;
}

interface AlertConfig {
  title: string;
  message: string;
  type?: AlertType;
  buttons?: AlertButton[];
  /** Optional Ionicons name for the top disc — auto-picked from title if omitted */
  icon?: IconName;
}

interface AlertContextType {
  showAlert: (config: AlertConfig) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);
  const [visible, setVisible] = useState(false);

  const showAlert = (config: AlertConfig) => {
    setAlertConfig(config);
    setVisible(true);
  };

  const hideAlert = () => {
    setVisible(false);
    // Clear config after animation
    setTimeout(() => setAlertConfig(null), 300);
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      {alertConfig && (
        <AthleticAlert
          visible={visible}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          buttons={alertConfig.buttons}
          icon={alertConfig.icon}
          onClose={hideAlert}
        />
      )}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  // Return a no-op implementation if context is not available
  // This prevents crashes during app initialization
  if (!context) {
    return {
      showAlert: (config: AlertConfig) => {
        console.warn('useAlert called outside AlertProvider:', config);
      },
    };
  }
  return context;
}
