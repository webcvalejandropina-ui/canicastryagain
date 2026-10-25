import type { Metadata } from "next";
import { DemoGame } from "@/features/demo/DemoGame";
export const metadata: Metadata = { title: "Demo jugable", description: "Prueba Canicas contra un rival automático, sin registro. Cambia el evento y descubre los fondos y dados de cada temporada." };
export default function DemoPage(): React.ReactElement { return <DemoGame />; }
