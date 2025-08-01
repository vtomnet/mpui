import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import { Button } from "@/components/ui/button";
  import { environments } from "@/lib/environments";

  interface Props {
    environment: string;
    setEnvironment: (value: string) => void;
  }

  export default function EnvironmentDropdown({ environment, setEnvironment }: Props) {
    return (
      <div className="fixed top-4 left-4 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-[240px] font-normal h-18 text-lg glass">
              {environment}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[240px] glass">
            <DropdownMenuRadioGroup
              value={environment}
              onValueChange={setEnvironment}
            >
              {environments.map((env) => (
                <DropdownMenuRadioItem key={env.name} value={env.name}>
                  {env.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }
