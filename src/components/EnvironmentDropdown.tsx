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
    const sortedEnvironments = [...environments].sort((a, b) => {
      const aIsGoogle = a.name.includes("Google Maps");
      const bIsGoogle = b.name.includes("Google Maps");
      if (aIsGoogle && !bIsGoogle) return -1;
      if (!aIsGoogle && bIsGoogle) return 1;
      return a.name.localeCompare(b.name);
    });

    return (
      <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full md:w-96 font-normal h-18 text-lg glass" style={{ borderRadius: '24px' }}>
              {environment}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width] glass rounded" style={{ borderRadius: '24px' }}>
            <DropdownMenuRadioGroup
              value={environment}
              onValueChange={(value) => {
                setEnvironment(value);
                localStorage.setItem("environment", value);
              }}
            >
              {sortedEnvironments.map((env) => (
                <DropdownMenuRadioItem key={env.name} value={env.name}>
                  {env.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
    );
  }
