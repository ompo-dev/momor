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
    <div className="space-y-3 p-4">
      <div className="border-l border-border-subtle/80 pl-4">
        <h3 className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
          {t('settings.language.title')}
        </h3>
        <p className="mb-3 text-[11px] leading-5 text-text-secondary">{t('settings.language.description')}</p>
        <div className="flex gap-2">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleChange(lang.code)}
              className={`rounded-sm border px-3 py-2 text-[12px] font-medium transition-colors ${
                i18n.language === lang.code
                  ? 'border-accent-primary/40 bg-accent-primary/10 text-text-primary'
                  : 'border-border-subtle/80 bg-background/18 text-text-secondary hover:bg-background/28'
              }`}
            >
              {lang.name}
            </button>
          ))}
        </div>
        {saved && <p className="mt-2 text-[11px] text-green-400">{t('settings.language.saved')}</p>}
      </div>
    </div>
  );
};

export default LanguageSettings;
