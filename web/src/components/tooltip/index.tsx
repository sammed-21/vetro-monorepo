import RcTooltip from "rc-tooltip";
import type { ReactNode } from "react";

import "./tooltip.css";

type Props = {
  children: ReactNode;
  content: ReactNode;
  stretch?: boolean;
  useParentContainer?: boolean;
  visible?: boolean;
};

const getTooltipContainer = (node: HTMLElement) => node.parentElement!;
// motionName is the prefix rc-motion uses to toggle the
// `vetro-tooltip-{appear,enter,leave}[-active]` classes that tooltip.css targets.
const motion = { motionName: "vetro-tooltip" };

export const Tooltip = ({
  children,
  content,
  stretch = false,
  useParentContainer = false,
  visible,
}: Props) => (
  <RcTooltip
    getTooltipContainer={useParentContainer ? getTooltipContainer : undefined}
    motion={motion}
    overlay={
      <div className="text-b-medium max-w-xs rounded-md bg-gray-900 px-1.5 py-1 text-white">
        {content}
      </div>
    }
    placement="top"
    showArrow={false}
    trigger={["hover"]}
    visible={visible}
  >
    <div className={`cursor-pointer ${stretch ? "size-full" : "w-fit"}`}>
      {children}
    </div>
  </RcTooltip>
);
