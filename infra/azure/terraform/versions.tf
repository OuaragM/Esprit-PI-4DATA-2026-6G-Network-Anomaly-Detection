terraform {
  required_version = ">= 1.5"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Remote state lives in the bootstrap storage account
  # (created by ../scripts/bootstrap.sh). Configure at init time:
  #
  #   terraform init \
  #     -backend-config="resource_group_name=<tfstate-rg>" \
  #     -backend-config="storage_account_name=<tfstate-sa>" \
  #     -backend-config="container_name=tfstate" \
  #     -backend-config="key=azure.terraform.tfstate" \
  #     -backend-config="use_azuread_auth=true"
  backend "azurerm" {}
}

provider "azurerm" {
  features {}
  # Subscription comes from ARM_SUBSCRIPTION_ID (CI) or `az login` context.
}
