import { CreateMenu } from "@/components/shared/create-menu";

/** The round "+" in the app header: the standard create menu on the dark bar. */
export function HeaderCreateMenu() {
  return <CreateMenu trigger="header" afterCreate="navigate" align="start" testId="button-primary-action" />;
}
