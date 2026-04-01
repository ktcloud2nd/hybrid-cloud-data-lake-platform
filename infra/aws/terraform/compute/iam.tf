# 1. IAM 역할(Role) 생성
# EC2 서비스가 이 역할을 수락(Assume)할 수 있도록 신뢰 정책을 설정합니다.
resource "aws_iam_role" "k3s_node_role" {
  name = "8team-k3s-node-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

# 2. SSM 관리 정책 연결
# 'AmazonSSMManagedInstanceCore' 정책을 연결하여 SSH 포트 개방 없이 SSM 접속을 허용합니다.
resource "aws_iam_role_policy_attachment" "k3s_node_ssm_policy" {
  role       = aws_iam_role.k3s_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# 3. Cluster Autoscaler 전용 인라인 정책 추가
# 마스터 노드에 설치된 Autoscaler가 워커 노드의 ASG 수량을 조절할 수 있게 합니다.
resource "aws_iam_role_policy" "cluster_autoscaler_policy" {
  name = "8team-cluster-autoscaler-policy"
  role = aws_iam_role.k3s_node_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "autoscaling:DescribeAutoScalingGroups",
          "autoscaling:DescribeAutoScalingInstances",
          "autoscaling:DescribeLaunchConfigurations",
          "autoscaling:DescribeTags",
          "autoscaling:SetDesiredCapacity",
          "autoscaling:TerminateInstanceInAutoScalingGroup",
          "ec2:DescribeLaunchTemplateVersions",
          "ec2:DescribeInstanceTypes"
        ]
        Resource = "*"
      }
    ]
  })
}

# 4. AWS Cloud Controller Manager 전용 인라인 정책 추가
resource "aws_iam_role_policy" "aws_ccm_policy" {
  name = "8team-aws-ccm-policy"
  role = aws_iam_role.k3s_node_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeInstances",
          "ec2:DescribeRegions",
          "ec2:DescribeTags",
          "ec2:DescribeAvailabilityZones",
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeSubnets",
          "ec2:DescribeVpcs"
        ]
        Resource = "*"
      }
    ]
  })
}

# 5. 인스턴스 프로파일 생성
# main.tf의 각 aws_instance 리소스에서 iam_instance_profile 인자로 참조됩니다.
resource "aws_iam_role_policy" "quicksight_embed_policy" {
  name = "8team-quicksight-embed-policy"
  role = aws_iam_role.k3s_node_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "quicksight:GenerateEmbedUrlForRegisteredUser"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_instance_profile" "k3s_node_profile" {
  name = "8team-k3s-node-instance-profile"
  role = aws_iam_role.k3s_node_role.name
}
