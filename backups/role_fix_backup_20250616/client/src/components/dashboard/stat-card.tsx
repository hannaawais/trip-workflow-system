import { Link } from "wouter";

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  linkText: string;
  linkUrl: string;
  bgColor: string;
  iconColor: string;
}

export default function StatCard({
  title,
  value,
  icon,
  linkText,
  linkUrl,
  bgColor,
  iconColor
}: StatCardProps) {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center">
          <div className={`flex-shrink-0 ${bgColor} rounded-md p-3`}>
            <div className={`h-6 w-6 ${iconColor}`}>{icon}</div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-neutral-400 truncate">
                {title}
              </dt>
              <dd>
                <div className="text-lg font-medium text-neutral-600">{value}</div>
              </dd>
            </dl>
          </div>
        </div>
      </div>
      <div className="bg-neutral-50 px-4 py-4 sm:px-6">
        <div className="text-sm">
          <Link href={linkUrl}>
            <a className="font-medium text-primary-500 hover:text-primary-600">
              {linkText} <span className="sr-only">{title}</span> →
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
}
