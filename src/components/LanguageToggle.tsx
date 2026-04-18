import { Globe } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="language">
          <Globe className="h-4 w-4" />
          <span className="hidden text-xs font-semibold uppercase sm:inline">{lang}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setLang("pt")} className={lang === "pt" ? "font-bold" : ""}>
          🇵🇹 Português (PT)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLang("en")} className={lang === "en" ? "font-bold" : ""}>
          🇺🇸 English (US)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
