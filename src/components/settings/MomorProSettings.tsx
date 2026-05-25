import React from "react";
import { useTranslation } from 'react-i18next';

const MomorProSettings: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-4">
      <div className="text-4xl">🎉</div>
      <h2 className="text-xl font-semibold text-text-primary">
        {t('settings.free.title')}
      </h2>
      <p className="text-sm text-text-secondary max-w-sm">
        {t('settings.free.description')}
      </p>
      <p className="text-xs text-text-tertiary">
        {t('settings.free.noLicense')}
      </p>
    </div>
  );
};

export { MomorProSettings };
export default MomorProSettings;
