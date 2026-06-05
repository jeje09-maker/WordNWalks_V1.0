'use client';

import { useTranslation } from '@/hooks/use-translation';
import { languages } from '@/lib/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function LanguageSelect() {
  const { lang, setLang } = useTranslation();

  return (
    <Select value={lang} onValueChange={(value) => setLang(value as any)}>
      <SelectTrigger className="w-auto bg-white text-black border-none font-medium h-8">
        <SelectValue placeholder="Select language" />
      </SelectTrigger>
      <SelectContent className="bg-white text-black">
        {languages.map((l) => (
          <SelectItem key={l.code} value={l.code} className="focus:bg-slate-100 focus:text-black">
            {l.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
