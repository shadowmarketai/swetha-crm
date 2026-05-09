/**
 * BuildingForType — picks the right 3D component for the building's typology.
 *
 * Used wherever we need a Three.js model that matches the project's intended
 * style — most importantly the AI render flow, where the *capture* must
 * structurally match what we're asking the AI to draw.
 */

import { lazy, Suspense } from "react"

const PEBBuilding        = lazy(() => import("./PEBBuilding"))
const CommercialBuilding = lazy(() => import("./CommercialBuilding"))
const ShowroomBuilding   = lazy(() => import("./ShowroomBuilding"))

export default function BuildingForType({ data = {}, layers }) {
  const t = (data.building_type || "").toLowerCase()
  let Component = PEBBuilding
  if (t === "commercial") Component = CommercialBuilding
  else if (t === "showroom") Component = ShowroomBuilding
  // 'warehouse' and 'factory' both use PEBBuilding (the existing model)

  return (
    <Suspense fallback={null}>
      <Component data={data} layers={layers} />
    </Suspense>
  )
}
