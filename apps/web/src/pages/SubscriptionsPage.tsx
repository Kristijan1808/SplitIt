import { ArrowLeft, Check, Sparkles, Users, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { LanguageToggle } from "../components/LanguageToggle";
import { ThemeToggle } from "../components/ThemeToggle";
import { useLanguage } from "../i18n";

export function SubscriptionsPage() {
  const { t } = useLanguage();

  const plans = [
    {
      name: t("subscriptionProPlusName"),
      description: t("subscriptionProPlusDescription"),
      features: [
        t("subscriptionDailyUploads").replace("{count}", "10"),
        t("subscriptionWeeklyUploads").replace("{count}", "30"),
      ],
      className: "subscriptionPlanProPlus",
      featured: true,
    },
    {
      name: t("subscriptionProName"),
      description: t("subscriptionProDescription"),
      features: [
        t("subscriptionDailyUploads").replace("{count}", "2"),
        t("subscriptionWeeklyUploads").replace("{count}", "10"),
      ],
      className: "subscriptionPlanPro",
    },
    {
      name: t("subscriptionFreeName"),
      description: t("subscriptionFreeDescription"),
      features: [
        t("subscriptionCoreFeatures"),
        t("subscriptionFreeCost"),
      ],
      className: "subscriptionPlanFree",
    },
  ];

  return (
    <main className="page subscriptionsPage">
      <div className="topBar">
        <div className="topBarControls">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>

      <Link className="backLink" to="/">
        <ArrowLeft size={18} /> {t("home")}
      </Link>

      <header className="subscriptionsHeader">
        <div className="subscriptionsEyebrow">
          <Sparkles size={16} />
          <span>{t("subscriptions")}</span>
        </div>
        <h1>{t("subscriptionsTitle")}</h1>
        <p className="muted">{t("subscriptionsIntro")}</p>
      </header>

      <section className="subscriptionPlans" aria-label={t("subscriptionsTitle")}>
        {plans.map((plan) => (
          <article
            key={plan.name}
            className={`subscriptionPlan card ${plan.className}${plan.featured ? " subscriptionPlanFeatured" : ""}`}
          >
            {plan.featured && (
              <span className="subscriptionFeaturedBadge">
                <Sparkles size={14} aria-hidden="true" />
                {t("subscriptionRecommended")}
              </span>
            )}
            <div className="subscriptionPlanHeading">
              <h2>{plan.name}</h2>
              <span className="subscriptionPlanIcon" aria-hidden="true">
                <Sparkles size={19} />
              </span>
            </div>
            <p className="muted subscriptionPlanDescription">{plan.description}</p>
            <ul className="subscriptionFeatureList">
              {plan.features.map((feature) => (
                <li key={feature}>
                  <Check size={17} aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="subscriptionScope card">
        <h2>{t("subscriptionScopeTitle")}</h2>
        <p className="muted">{t("subscriptionScopeDescription")}</p>
        <div className="subscriptionScopeOptions">
          <div className="subscriptionScopeOption">
            <UserRound size={20} aria-hidden="true" />
            <strong>{t("subscriptionPerUser")}</strong>
          </div>
          <div className="subscriptionScopeOption">
            <Users size={20} aria-hidden="true" />
            <strong>{t("subscriptionPerGroup")}</strong>
          </div>
        </div>
      </section>
    </main>
  );
}
