import type { HostKind } from '@shared/host-routing';
import { hostKind } from '../../utils/hosts';

export interface PortalHostCheck {
  /** 'single' when no portal host is configured, else which of the two hosts this request was classified as. */
  kind: HostKind;
  /** The hostname the server believes the request was addressed to (after the proxy, if it forwards the original one). */
  hostSeen: string;
}

/**
 * The owner's switch-over check: open https://<portal host>/api/v2/portal/host-check. It must say kind "portal" with the
 * portal hostname; "staff" there means the proxy is not forwarding the original host. Nothing else is revealed.
 */
export const portalHostCheckService = {
  check(hostname: string | undefined): PortalHostCheck {
    const hostSeen = (hostname ?? '').toLowerCase().slice(0, 255);
    return { kind: hostKind({ hostname: hostSeen }), hostSeen };
  },
};
