import React, { useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  trigger?: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  triggerClassName?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Panel({ title, trigger, children, triggerClassName, isOpen: controlledIsOpen, onClose }: Props) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  const open = () => {
    if (!isControlled) {
      setInternalIsOpen(true);
    }
  };

  const close = () => {
    if (onClose) {
      onClose();
    }
    if (!isControlled) {
      setInternalIsOpen(false);
    }
  };

  return (
    <>
      {trigger && (
        <div className={triggerClassName}>
          <Button onClick={open}>
            {trigger}
          </Button>
        </div>
      )}

      {isOpen &&
        createPortal(
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-background w-full max-w-2xl h-full max-h-[80vh] rounded-lg p-4 flex flex-col shadow-2xl">
              <div className="flex justify-between items-center mb-4 pb-4 border-b">
                <h2 className="text-xl font-bold">{title}</h2>
                <Button onClick={close} variant="ghost" size="sm">
                  <FontAwesomeIcon icon={faTimes} className="text-black" />
                </Button>
              </div>

              {children(close)}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
