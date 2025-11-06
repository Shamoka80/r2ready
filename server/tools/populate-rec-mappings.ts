
import { db } from "../db.js";
import { recMapping } from "../../shared/schema.js";
import { eq } from "drizzle-orm";

// Comprehensive R2v3 REC (R2 Equipment Categorization) Mappings
const COMPREHENSIVE_REC_MAPPINGS = [
  // Core Legal & Business Entity Requirements
  {
    recCode: "LEGAL-01",
    recName: "Legal Entity Identification", 
    description: "Basic legal entity information required for all R2v3 assessments",
    parentRecCode: null,
    relatedAppendices: [],
    processingRequirements: {
      mandatory: true,
      weight: 3.0,
      priority: "critical",
      applicability: "all_organizations"
    }
  },
  {
    recCode: "LEGAL-02",
    recName: "Business Entity Classification",
    description: "Business entity type classification for regulatory compliance mapping",
    parentRecCode: "LEGAL-01",
    relatedAppendices: [],
    processingRequirements: {
      mandatory: true,
      weight: 2.5,
      priority: "high",
      applicability: "all_organizations"
    }
  },
  {
    recCode: "LEGAL-03",
    recName: "Regulatory Compliance Status",
    description: "Current compliance status with applicable environmental regulations",
    parentRecCode: "LEGAL-01",
    relatedAppendices: [],
    processingRequirements: {
      mandatory: true,
      weight: 3.0,
      priority: "critical",
      applicability: "all_organizations"
    }
  },

  // Facility & Infrastructure Categories
  {
    recCode: "FACILITY-01",
    recName: "Facility Count & Structure",
    description: "Number and organizational structure of facilities",
    parentRecCode: null,
    relatedAppendices: ["APP-G"],
    processingRequirements: {
      mandatory: true,
      weight: 2.0,
      priority: "high",
      triggers: {
        multi_site: "facility_count > 1",
        campus: "structure_type === 'CAMPUS'",
        group: "structure_type === 'GROUP'"
      }
    }
  },
  {
    recCode: "FACILITY-02",
    recName: "Certification Structure Type",
    description: "Determines how facilities are organized for certification purposes",
    parentRecCode: "FACILITY-01",
    relatedAppendices: ["APP-G"],
    processingRequirements: {
      mandatory: true,
      weight: 2.5,
      priority: "high",
      conditional_logic: {
        campus_requires: ["shared_management", "unified_procedures"],
        group_requires: ["standardized_processes", "consistent_oversight"]
      }
    }
  },
  {
    recCode: "FACILITY-03",
    recName: "Physical Security & Access Control",
    description: "Security measures for facility access and material protection",
    parentRecCode: "FACILITY-01",
    relatedAppendices: [],
    processingRequirements: {
      mandatory: true,
      weight: 2.0,
      priority: "medium",
      applicability: "all_facilities"
    }
  },

  // Processing Activity Categories
  {
    recCode: "PROC-01",
    recName: "Collection Activities",
    description: "Electronic waste collection and transportation processes",
    parentRecCode: null,
    relatedAppendices: ["APP-G"],
    processingRequirements: {
      weight: 1.5,
      priority: "medium",
      triggers: {
        transportation: "collection_services === true",
        logistics: "pickup_services === true"
      }
    }
  },
  {
    recCode: "PROC-02",
    recName: "Processing Activities",
    description: "Core electronics processing and handling activities",
    parentRecCode: null,
    relatedAppendices: ["APP-A", "APP-B", "APP-C", "APP-D"],
    processingRequirements: {
      mandatory: true,
      weight: 3.0,
      priority: "critical",
      activity_mapping: {
        refurbishment: "APP-B",
        materials_recovery: "APP-C",
        data_destruction: "APP-D",
        focus_materials: "APP-A"
      }
    }
  },
  {
    recCode: "PROC-03",
    recName: "Sorting & Segregation",
    description: "Material sorting and segregation procedures",
    parentRecCode: "PROC-02",
    relatedAppendices: ["APP-A", "APP-C"],
    processingRequirements: {
      mandatory: true,
      weight: 2.0,
      priority: "high",
      triggers: {
        focus_materials: "handles_mercury || handles_lead || handles_cadmium",
        materials_recovery: "processing_activities.includes('Materials Recovery')"
      }
    }
  },

  // Data Security Categories
  {
    recCode: "DATA-01",
    recName: "Data Destruction Services",
    description: "Data destruction and sanitization services",
    parentRecCode: null,
    relatedAppendices: ["APP-D"],
    processingRequirements: {
      weight: 3.0,
      priority: "critical",
      triggers: {
        appendix_d: "data_destruction_activities === true",
        nist_compliance: "data_destruction_activities === true",
        certification_required: "data_destruction_activities === true"
      }
    }
  },
  {
    recCode: "DATA-02",
    recName: "Data Security Infrastructure",
    description: "Physical and logical data security measures",
    parentRecCode: "DATA-01",
    relatedAppendices: ["APP-D"],
    processingRequirements: {
      weight: 2.5,
      priority: "high",
      conditional_on: "DATA-01"
    }
  },

  // Supply Chain & Vendor Categories
  {
    recCode: "SUPPLY-01",
    recName: "Downstream Vendor Management",
    description: "Management of downstream vendors and supply chain",
    parentRecCode: null,
    relatedAppendices: ["APP-E"],
    processingRequirements: {
      weight: 2.5,
      priority: "high",
      triggers: {
        international: "international_shipments === true",
        vendor_count: "downstream_vendors > 0",
        due_diligence: "non_r2_vendors > 0"
      }
    }
  },
  {
    recCode: "SUPPLY-02",
    recName: "International Operations",
    description: "International shipment and cross-border operations",
    parentRecCode: "SUPPLY-01",
    relatedAppendices: ["APP-E", "APP-F"],
    processingRequirements: {
      weight: 3.0,
      priority: "critical",
      triggers: {
        appendix_e: "international_shipments === true",
        customs_compliance: "international_shipments === true",
        export_controls: "international_shipments === true"
      }
    }
  },

  // Appendix-Specific Categories
  {
    recCode: "APP-A",
    recName: "Focus Materials & Components",
    description: "Appendix A: Focus Materials and Components management",
    parentRecCode: null,
    relatedAppendices: ["APP-A"],
    processingRequirements: {
      weight: 2.5,
      priority: "high",
      triggers: {
        mercury_containing: "focus_materials.includes('Mercury-containing devices')",
        lead_containing: "focus_materials.includes('CRT displays')",
        pcb_containing: "focus_materials.includes('PCB-containing equipment')"
      }
    }
  },
  {
    recCode: "APP-B",
    recName: "Equipment Refurbishment",
    description: "Appendix B: Equipment Refurbishment and Resale requirements",
    parentRecCode: null,
    relatedAppendices: ["APP-B"],
    processingRequirements: {
      weight: 2.0,
      priority: "medium",
      triggers: {
        refurbishment: "processing_activities.includes('Refurbishment')",
        resale: "processing_activities.includes('Resale')",
        testing: "refurbishment_activities === true"
      }
    }
  },
  {
    recCode: "APP-C",
    recName: "Materials Recovery",
    description: "Appendix C: Materials Recovery requirements",
    parentRecCode: null,
    relatedAppendices: ["APP-C"],
    processingRequirements: {
      weight: 2.0,
      priority: "medium",
      triggers: {
        materials_recovery: "processing_activities.includes('Materials Recovery')",
        metal_recovery: "processing_activities.includes('Metal Recovery')",
        plastic_recovery: "processing_activities.includes('Plastic Recovery')"
      }
    }
  },
  {
    recCode: "APP-D",
    recName: "Data Destruction",
    description: "Appendix D: Data Destruction requirements",
    parentRecCode: null,
    relatedAppendices: ["APP-D"],
    processingRequirements: {
      weight: 3.0,
      priority: "critical",
      triggers: {
        data_destruction: "data_destruction_activities === true",
        sanitization: "processing_activities.includes('Data Sanitization')",
        nist_compliance: "data_destruction_activities === true"
      }
    }
  },
  {
    recCode: "APP-E",
    recName: "Downstream Vendors",
    description: "Appendix E: Downstream Vendor requirements",
    parentRecCode: null,
    relatedAppendices: ["APP-E"],
    processingRequirements: {
      weight: 2.5,
      priority: "high",
      triggers: {
        downstream_vendors: "total_downstream_vendors > 0",
        international: "international_shipments === true",
        non_r2_vendors: "num_non_r2_dsv > 0"
      }
    }
  },
  {
    recCode: "APP-F",
    recName: "Disposition Hierarchy",
    description: "Appendix F: Disposition Hierarchy requirements",
    parentRecCode: null,
    relatedAppendices: ["APP-F"],
    processingRequirements: {
      weight: 1.5,
      priority: "medium",
      triggers: {
        disposition_priority: "processing_activities.length > 1",
        hierarchy_compliance: "multiple_disposition_methods === true"
      }
    }
  },
  {
    recCode: "APP-G",
    recName: "Transportation & Storage",
    description: "Appendix G: Transportation and Storage requirements",
    parentRecCode: null,
    relatedAppendices: ["APP-G"],
    processingRequirements: {
      weight: 1.5,
      priority: "medium",
      triggers: {
        multi_facility: "total_facilities > 1",
        transportation: "collection_activities === true",
        storage: "temporary_storage === true"
      }
    }
  },

  // Management System Categories
  {
    recCode: "MGMT-01",
    recName: "Environmental Management System",
    description: "EMS integration with R2v3 requirements",
    parentRecCode: null,
    relatedAppendices: [],
    processingRequirements: {
      weight: 1.0,
      priority: "low",
      bonus_factor: 0.1,
      triggers: {
        iso14001: "ehsms_type.includes('ISO 14001')",
        existing_ems: "ehsms_type !== null"
      }
    }
  },
  {
    recCode: "MGMT-02",
    recName: "Quality Management System",
    description: "QMS integration with R2v3 requirements",
    parentRecCode: null,
    relatedAppendices: [],
    processingRequirements: {
      weight: 0.5,
      priority: "low",
      bonus_factor: 0.05,
      triggers: {
        iso9001: "qms_type.includes('ISO 9001')",
        existing_qms: "qms_type !== null"
      }
    }
  },

  // Certification & Administrative Categories
  {
    recCode: "CERT-01",
    recName: "Certification Type & Objectives",
    description: "Type and objectives of R2v3 certification being pursued",
    parentRecCode: null,
    relatedAppendices: [],
    processingRequirements: {
      mandatory: true,
      weight: 1.5,
      priority: "medium",
      determines_scope: true,
      triggers: {
        initial: "certification_type === 'INITIAL'",
        recertification: "certification_type === 'RECERTIFICATION'",
        scope_extension: "certification_type === 'SCOPE_EXTENSION'"
      }
    }
  },
  {
    recCode: "CERT-02",
    recName: "Audit Complexity Factors",
    description: "Factors that determine audit complexity and duration",
    parentRecCode: "CERT-01",
    relatedAppendices: [],
    processingRequirements: {
      weight: 1.0,
      priority: "low",
      complexity_multipliers: {
        multi_facility: 1.5,
        international_ops: 1.3,
        multiple_appendices: 1.2,
        high_volume: 1.1
      }
    }
  },

  // Personnel & Training Categories
  {
    recCode: "PERSONNEL-01",
    recName: "Key Personnel Roles",
    description: "Key personnel roles and responsibilities",
    parentRecCode: null,
    relatedAppendices: [],
    processingRequirements: {
      mandatory: true,
      weight: 1.5,
      priority: "medium",
      required_roles: ["r2_contact", "top_management", "data_protection_rep"]
    }
  },
  {
    recCode: "PERSONNEL-02",
    recName: "Workforce & Training",
    description: "Workforce size and training requirements",
    parentRecCode: "PERSONNEL-01",
    relatedAppendices: [],
    processingRequirements: {
      weight: 1.0,
      priority: "low",
      triggers: {
        large_workforce: "total_employees > 50",
        seasonal_variations: "seasonal_workforce_variations === true",
        multi_language: "languages_spoken_by_mgmt.length > 1"
      }
    }
  }
];

async function populateRECMappings() {
  try {
    console.log("🎯 Starting comprehensive REC mappings population...");

    // Clear existing REC mappings
    console.log("🧹 Clearing existing REC mappings...");
    await db.delete(recMapping);

    // Insert comprehensive REC mappings
    console.log("📊 Inserting comprehensive REC mappings...");
    let insertedCount = 0;
    
    for (const mapping of COMPREHENSIVE_REC_MAPPINGS) {
      await db.insert(recMapping).values(mapping);
      insertedCount++;
      console.log(`   ✓ Added REC mapping: ${mapping.recCode} - ${mapping.recName}`);
    }

    // Verify results
    const allMappings = await db.select().from(recMapping);
    
    console.log(`\n✅ REC mappings population completed!`);
    console.log(`   📊 Total REC mappings: ${allMappings.length}`);
    console.log(`   🎯 Coverage: Core requirements, all appendices, facility types, processing activities`);
    
    // Display category breakdown
    const categoryCounts = {
      legal: allMappings.filter(m => m.recCode.startsWith('LEGAL')).length,
      facility: allMappings.filter(m => m.recCode.startsWith('FACILITY')).length,
      processing: allMappings.filter(m => m.recCode.startsWith('PROC')).length,
      data: allMappings.filter(m => m.recCode.startsWith('DATA')).length,
      supply: allMappings.filter(m => m.recCode.startsWith('SUPPLY')).length,
      appendices: allMappings.filter(m => m.recCode.startsWith('APP')).length,
      management: allMappings.filter(m => m.recCode.startsWith('MGMT')).length,
      certification: allMappings.filter(m => m.recCode.startsWith('CERT')).length,
      personnel: allMappings.filter(m => m.recCode.startsWith('PERSONNEL')).length
    };

    console.log("\n📋 Category Breakdown:");
    Object.entries(categoryCounts).forEach(([category, count]) => {
      console.log(`   • ${category.toUpperCase()}: ${count} mappings`);
    });

    console.log("\n🚀 REC mapping system ready for intelligent question filtering!");

  } catch (error) {
    console.error("❌ Error populating REC mappings:", error);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith('populate-rec-mappings.ts')) {
  populateRECMappings().then(() => {
    console.log("🎯 REC mappings population complete!");
    process.exit(0);
  }).catch((error) => {
    console.error("💥 Population failed:", error);
    process.exit(1);
  });
}

export { populateRECMappings };
