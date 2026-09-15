import { Hammer } from "lucide-react";
import { EmptyState } from "@/components/shared";
import { t, type StringKey } from "@/i18n/t.ts";

export function PlaceholderPage({ screen }: { screen: StringKey }) {
  return <EmptyState icon={Hammer} title={t(screen)} hint={t("placeholder.comingHint")} className="flex-1" />;
}
