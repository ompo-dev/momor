import React, { useState } from "react";
import { Trash2, Sparkles, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { useSkills, useAbilityActions, type Skill } from "./useAbilities";

interface SkillEditorProps {
  id: string;
  onDeleted: () => void;
}

const SkillEditor: React.FC<SkillEditorProps> = ({ id, onDeleted }) => {
  const { t } = useTranslation();
  const { data: skills, isLoading } = useSkills();
  const skill = skills?.find((s) => s.id === id);

  if (isLoading || !skill) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
        {t("workspace.loading")}
      </div>
    );
  }
  return <SkillForm key={id} skill={skill} onDeleted={onDeleted} />;
};

const SkillForm: React.FC<{ skill: Skill; onDeleted: () => void }> = ({
  skill,
  onDeleted,
}) => {
  const { t } = useTranslation();
  const { invalidateSkills } = useAbilityActions();
  const [name, setName] = useState(skill.name);
  const [description, setDescription] = useState(skill.description);
  const [content, setContent] = useState(skill.content);
  const [enabled, setEnabled] = useState(skill.enabled);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    await window.electronAPI.skillUpdate(skill.id, {
      name: name.trim() || "skill",
      description: description.trim(),
      content,
      enabled,
    });
    invalidateSkills();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const remove = async () => {
    await window.electronAPI.skillDelete(skill.id);
    invalidateSkills();
    onDeleted();
  };

  const field =
    "w-full bg-bg-input border border-border rounded-md px-3 py-2 text-[13px] text-text-primary outline-none focus:border-primary/50";
  const label = "text-[12px] font-medium text-text-secondary mb-1 block";

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-2xl mx-auto px-10 py-10 space-y-5">
        <div className="flex items-center gap-3">
          <Sparkles size={22} className="text-text-secondary" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("workspace.skillNamePlaceholder")}
            className="flex-1 bg-transparent text-2xl font-bold text-text-primary placeholder:text-text-tertiary outline-none"
          />
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-text-secondary">
              {enabled ? t("workspace.enabled") : t("workspace.disabled")}
            </span>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        <div>
          <label className={label}>{t("workspace.skillDescription")}</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("workspace.skillDescriptionPlaceholder")}
            className={field}
          />
          <p className="mt-1 text-[11px] text-text-tertiary">
            {t("workspace.skillDescriptionHint")}
          </p>
        </div>

        <div>
          <label className={label}>{t("workspace.skillInstructions")}</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("workspace.skillInstructionsPlaceholder")}
            rows={14}
            className={`${field} resize-y leading-relaxed`}
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={remove} className="text-destructive hover:text-destructive">
            <Trash2 size={14} className="mr-1.5" />
            {t("workspace.delete")}
          </Button>
          <Button size="sm" onClick={save} className="gap-1.5">
            <Save size={14} />
            {saved ? t("workspace.saved") : t("workspace.save")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SkillEditor;
