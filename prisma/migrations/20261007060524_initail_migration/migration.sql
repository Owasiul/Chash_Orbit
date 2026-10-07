-- CreateTable
CREATE TABLE "Farm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "location_name" TEXT NOT NULL,
    "country" TEXT,
    "area" DOUBLE PRECISION,
    "area_unit" TEXT DEFAULT 'acres',
    "soil_type" TEXT,
    "irrigation_type" TEXT,
    "current_crop" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmerPreference" (
    "id" TEXT NOT NULL,
    "farm_id" TEXT NOT NULL,
    "soil_health_weight" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "water_weight" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "climate_weight" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "income_weight" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmerPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmerCrop" (
    "id" TEXT NOT NULL,
    "farm_id" TEXT NOT NULL,
    "crop_id" TEXT NOT NULL,
    "crop_role" TEXT NOT NULL,

    CONSTRAINT "FarmerCrop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" TEXT,
    "season" TEXT,
    "water_demand" TEXT,
    "root_depth" TEXT,
    "nitrogen_effect" TEXT,
    "heat_tolerance" TEXT,
    "drought_tolerance" TEXT,
    "flood_tolerance" TEXT,
    "soil_benefits" TEXT,
    "water_mm" DOUBLE PRECISION,
    "grow_temp_min" DOUBLE PRECISION,
    "grow_temp_max" DOUBLE PRECISION,
    "base_income" DOUBLE PRECISION,

    CONSTRAINT "Crop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldObservation" (
    "id" TEXT NOT NULL,
    "farm_id" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION,
    "rainfall" DOUBLE PRECISION,
    "soil_moisture" DOUBLE PRECISION,
    "ndvi" DOUBLE PRECISION,
    "heat_risk" DOUBLE PRECISION,
    "drought_risk" DOUBLE PRECISION,
    "flood_risk" DOUBLE PRECISION,
    "soil_moisture_deficit" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'demo',
    "observation_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotationPlan" (
    "id" TEXT NOT NULL,
    "farm_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "overall_score" DOUBLE PRECISION NOT NULL,
    "soil_score" DOUBLE PRECISION NOT NULL,
    "water_score" DOUBLE PRECISION NOT NULL,
    "climate_score" DOUBLE PRECISION NOT NULL,
    "income_score" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RotationPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotationYear" (
    "id" TEXT NOT NULL,
    "rotation_plan_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "crop_id" TEXT NOT NULL,
    "cover_crop" TEXT,
    "irrigation_level" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "RotationYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NasaCache" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "date_range" TEXT NOT NULL,
    "parameters" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NasaCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Farm_location_name_idx" ON "Farm"("location_name");

-- CreateIndex
CREATE UNIQUE INDEX "Farm_latitude_longitude_key" ON "Farm"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "FarmerPreference_farm_id_key" ON "FarmerPreference"("farm_id");

-- CreateIndex
CREATE INDEX "FarmerCrop_farm_id_idx" ON "FarmerCrop"("farm_id");

-- CreateIndex
CREATE UNIQUE INDEX "FarmerCrop_farm_id_crop_id_key" ON "FarmerCrop"("farm_id", "crop_id");

-- CreateIndex
CREATE UNIQUE INDEX "Crop_name_key" ON "Crop"("name");

-- CreateIndex
CREATE INDEX "FieldObservation_farm_id_idx" ON "FieldObservation"("farm_id");

-- CreateIndex
CREATE UNIQUE INDEX "RotationPlan_farm_id_key" ON "RotationPlan"("farm_id");

-- CreateIndex
CREATE INDEX "RotationYear_rotation_plan_id_idx" ON "RotationYear"("rotation_plan_id");

-- CreateIndex
CREATE INDEX "NasaCache_source_latitude_longitude_idx" ON "NasaCache"("source", "latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "NasaCache_source_latitude_longitude_date_range_parameters_key" ON "NasaCache"("source", "latitude", "longitude", "date_range", "parameters");

-- AddForeignKey
ALTER TABLE "FarmerPreference" ADD CONSTRAINT "FarmerPreference_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerCrop" ADD CONSTRAINT "FarmerCrop_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmerCrop" ADD CONSTRAINT "FarmerCrop_crop_id_fkey" FOREIGN KEY ("crop_id") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldObservation" ADD CONSTRAINT "FieldObservation_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotationPlan" ADD CONSTRAINT "RotationPlan_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotationYear" ADD CONSTRAINT "RotationYear_rotation_plan_id_fkey" FOREIGN KEY ("rotation_plan_id") REFERENCES "RotationPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotationYear" ADD CONSTRAINT "RotationYear_crop_id_fkey" FOREIGN KEY ("crop_id") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
