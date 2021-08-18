data "terraform_remote_state" "data_persistence" {
  backend   = "s3"
  config    = var.data_persistence_remote_state_config
  workspace = terraform.workspace
}

module "data_migration1" {
  source = "../../lambdas/data-migration1"

  prefix = var.prefix

  permissions_boundary_arn = var.permissions_boundary_arn

  vpc_id            = var.vpc_id
  lambda_subnet_ids = var.lambda_subnet_ids

  dynamo_tables = data.terraform_remote_state.data_persistence.outputs.dynamo_tables

  rds_security_group_id = var.rds_security_group
  rds_user_access_secret_arn = var.database_credentials_secret_arn
  rds_connection_timing_configuration = var.rds_connection_timing_configuration

  // TODO this comes from archive
  provider_kms_key_id = var.provider_kms_key_id

  tags = merge(var.tags, { Deployment = var.prefix })
}
