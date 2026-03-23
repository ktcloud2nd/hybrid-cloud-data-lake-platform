data "terraform_remote_state" "network" {
  # 기존코드+수정됨
  # backend = "local"
  backend = "s3"

  config = {
    # 기존코드+수정됨
    # path = var.network_state_path
    bucket = var.network_state_bucket
    key    = var.network_state_key
    region = var.network_state_region
  }
}
