output "master_a_instance_id" {
  description = "EC2 instance ID for the K3s control-plane node in Private-App-A (used for SSM)."
  value       = aws_instance.k3s_master_a.id
}

output "master_c_instance_id" {
  description = "EC2 instance ID for the K3s control-plane node in Private-App-C (used for SSM)."
  value       = aws_instance.k3s_master_c.id
}

output "master_a_private_ip" {
  description = "Static private IP for the K3s control-plane node in Private-App-A."
  value       = aws_instance.k3s_master_a.private_ip
}

output "master_c_private_ip" {
  description = "Static private IP for the K3s control-plane node in Private-App-C."
  value       = aws_instance.k3s_master_c.private_ip
}

output "k3s_nlb_dns" {
  description = "Shared internal NLB DNS for the K3s API server endpoint."
  value       = aws_lb.k3s_nlb.dns_name
}

output "worker_user_asg_name" {
  description = "Auto Scaling Group name for the user workload worker pool."
  value       = aws_autoscaling_group.worker_user_asg.name
}

output "worker_op_asg_name" {
  description = "Auto Scaling Group name for the operator workload worker pool."
  value       = aws_autoscaling_group.worker_op_asg.name
}
