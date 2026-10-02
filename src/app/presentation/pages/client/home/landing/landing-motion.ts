/** Khung cuộn của trang client: mat-sidenav-content nếu nó tự cuộn, nếu không thì cửa sổ. */
export function pageScroller(host: HTMLElement): Element | Window {
  const wrapper = host.closest('.client-content-wrapper') as HTMLElement | null;
  if (wrapper) {
    const overflow = getComputedStyle(wrapper).overflowY;
    if (/(auto|scroll)/.test(overflow) && wrapper.scrollHeight > wrapper.clientHeight + 1) return wrapper;
  }
  return window;
}

export function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Đường dẫn sang app đăng nhập/đăng ký, quay lại trang hiện tại sau khi xong. */
export function authUrl(base: string, path: 'login' | 'register'): string {
  return `${base}/${path}?redirect=${encodeURIComponent(window.location.href)}`;
}
