import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [saved, setSaved] = useState(false);

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'pt-BR', name: 'Português (BR)' },
  ];

  const handleChange = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('ui_language', code);
    const aiLang = code === 'pt-BR' ? 'Portuguese' : 'English';
    window.electronAPI?.setAiResponseLanguage?.(aiLang);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-1">{t('settings.language.title')}</h3>
        <p className="text-xs text-text-secondary mb-3">{t('settings.language.description')}</p>
        <div className="flex gap-2">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleChange(lang.code)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                i18n.language === lang.code
                  ? 'bg-accent-primary text-white'
                  : 'bg-bg-input text-text-secondary hover:bg-bg-elevated'
              }`}
            >
              {lang.name}
            </button>
          ))}
        </div>
        {saved && <p className="text-xs text-green-400 mt-2">{t('settings.language.saved')}</p>}
      </div>
    </div>
  );
};

export default LanguageSettings;
