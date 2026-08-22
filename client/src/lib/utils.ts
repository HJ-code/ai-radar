/** 轻量 cn：过滤假值并拼接 class（替代 clsx + tailwind-merge） */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}