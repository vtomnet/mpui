import type { FC } from "react";
import Panel from "./Panel";

interface Props {
  xml: string;
  isOpen: boolean;
  onClose: () => void;
}

const XmlResponsePanel: FC<Props> = ({ xml, isOpen, onClose }) => (
  <Panel title="XML Response" isOpen={isOpen} onClose={onClose}>
    {() => (
      <pre className="flex-1 overflow-auto text-sm bg-gray-100 p-2 rounded">
        <code>{xml}</code>
      </pre>
    )}
  </Panel>
);

export default XmlResponsePanel;
