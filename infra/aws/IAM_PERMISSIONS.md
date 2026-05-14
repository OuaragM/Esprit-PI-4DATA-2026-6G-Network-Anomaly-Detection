# Required IAM Permissions For Terraform Apply

The current AWS identity used during the first apply was:

```text
arn:aws:iam::567653861179:user/samops-user
```

The apply partially created networking, RDS, ALB, S3, and ECS cluster resources, then failed because this user is missing permissions for:

- IAM role/policy creation
- Secrets Manager secret creation
- Cloud Map / Service Discovery namespace creation
- EFS tagging

If the AWS console says "The selected policies exceed this account's quota",
`samops-user` already has the default maximum number of managed policies
attached. In that case, do **not** attach more managed policies. Add one inline
policy to `samops-user` instead.

Fast console path:

```text
IAM -> Users -> samops-user -> Permissions -> Add permissions ->
Create inline policy -> JSON
```

Paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "TerraformMissingIamPermissions",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:PassRole",
        "iam:TagRole",
        "iam:UntagRole",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:CreatePolicy",
        "iam:DeletePolicy",
        "iam:GetPolicy",
        "iam:GetPolicyVersion",
        "iam:ListPolicyVersions",
        "iam:CreatePolicyVersion",
        "iam:DeletePolicyVersion",
        "iam:CreateInstanceProfile",
        "iam:DeleteInstanceProfile",
        "iam:GetInstanceProfile",
        "iam:AddRoleToInstanceProfile",
        "iam:RemoveRoleFromInstanceProfile",
        "iam:TagInstanceProfile",
        "iam:UntagInstanceProfile"
      ],
      "Resource": "*"
    },
    {
      "Sid": "TerraformMissingSecretDiscoveryAndEfsPermissions",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:*",
        "servicediscovery:*",
        "elasticfilesystem:*"
      ],
      "Resource": "*"
    }
  ]
}
```

Name it:

```text
VeradoTerraformMissingPermissions
```

Alternatively, if you can remove existing managed policies, attach these AWS
managed policies to `samops-user`, then rerun Terraform:

```text
IAMFullAccess
SecretsManagerReadWrite
AWSCloudMapFullAccess
AmazonElasticFileSystemFullAccess
```

Existing attached policies already cover most of the rest:

```text
AmazonEC2FullAccess
AmazonRDSFullAccess
AmazonECS_FullAccess
AmazonS3FullAccess
CloudWatchFullAccess
```

After permissions are fixed:

```bash
cd infra/aws/terraform
terraform apply
```

If you do not want to continue, destroy the partial stack to stop charges:

```bash
cd infra/aws/terraform
terraform destroy
```

Resources currently known in Terraform state after the failed apply include:

- RDS PostgreSQL: `verado-demo-postgres`
- ALB: `verado-demo-alb`
- S3 bucket: `verado-demo-demo-assets-20260514142352368600000004`
- ECS cluster: `verado-demo-cluster`
- VPC, subnets, route tables, security groups, and CloudWatch log group
