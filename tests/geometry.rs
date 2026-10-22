use relief_forge::*;
fn p(v:&[(f64,f64)],closed:bool)->Path {Path{points:v.iter().map(|(x,y)|Point::new(*x,*y)).collect(),closed}}
#[test] fn duplicate_closed_reversed_rotated(){let a=p(&[(0.,0.),(10.,0.),(10.,10.),(0.,10.)],true);let b=p(&[(10.,10.),(10.,0.),(0.,0.),(0.,10.)],true);assert!(duplicate(&a,&b,0.01));assert_eq!(remove_duplicates(&[a,b],0.01).len(),1);}
#[test] fn open_path_is_not_closed_duplicate(){let a=p(&[(0.,0.),(1.,0.),(0.,1.)],true);let mut b=a.clone();b.closed=false;assert!(!duplicate(&a,&b,0.01));}
#[test] fn bow_tie_has_one_crossing(){let a=p(&[(0.,0.),(10.,10.),(0.,10.),(10.,0.)],true);let issues=diagnose(&[a],0.01);assert_eq!(issues.iter().filter(|x|x.kind=="self_intersection").count(),1);}
#[test] fn adjacent_corner_is_not_crossing(){let a=p(&[(0.,0.),(10.,0.),(10.,10.)],false);assert!(!diagnose(&[a],0.01).iter().any(|x|x.kind.contains("intersection")));}
#[test] fn adjacent_backtracking_is_overlap(){let a=p(&[(0.,0.),(10.,0.),(5.,0.)],false);assert!(diagnose(&[a],0.01).iter().any(|x|x.kind=="overlap"));}
#[test] fn clean_nodes_keeps_nonconsecutive_repeats(){let a=p(&[(0.,0.),(0.001,0.),(10.,0.),(0.,0.),(5.,5.)],false);let b=clean_nodes(&[a],0.01);assert_eq!(b[0].points.len(),4);assert_eq!(b[0].points[0],b[0].points[2]);}
#[test] fn joins_reversed_endpoints(){let a=p(&[(0.,0.),(10.,0.)],false);let b=p(&[(20.,0.),(10.005,0.)],false);let r=join(&[a,b],0.01);assert_eq!(r.len(),1);assert_eq!(r[0].points.len(),3);assert!((r[0].length()-20.).abs()<0.01);}
#[test] fn ambiguous_junction_is_untouched(){let a=p(&[(0.,0.),(10.,0.)],false);let b=p(&[(10.,0.),(20.,0.)],false);let c=p(&[(10.,0.),(10.,10.)],false);assert_eq!(join(&[a,b,c],0.01).len(),3);}
#[test] fn close_only_within_tolerance(){let a=p(&[(0.,0.),(10.,0.),(10.,10.),(0.005,0.)],false);assert!(close_near(&[a.clone()],0.01)[0].closed);assert!(!close_near(&[a],0.001)[0].closed);}
#[test] fn split_crossing_yields_four_spans(){let a=p(&[(0.,0.),(10.,10.)],false);let b=p(&[(0.,10.),(10.,0.)],false);let r=split_intersections(&[a,b]).unwrap();assert_eq!(r.len(),4);assert!(r.iter().all(|p|p.points.iter().any(|x|*x==Point::new(5.,5.))));}
#[test] fn figure_eight_retains_both_loops(){let a=p(&[(0.,0.),(10.,10.),(0.,10.),(10.,0.)],true);let r=extract_loops(&[a],1.);assert_eq!(r.len(),2);assert!(r.iter().all(|p|p.closed));assert!((r.iter().map(|p|p.area().abs()).sum::<f64>()-50.).abs()<1e-9);}
#[test] fn simplify_with_error_budget(){let a=p(&[(0.,0.),(5.,0.005),(10.,0.)],false);assert_eq!(simplify(&[a.clone()],0.01)[0].points.len(),2);assert_eq!(simplify(&[a],0.001)[0].points.len(),3);}
#[test] fn area_direction_is_cartesian(){let a=p(&[(0.,0.),(10.,0.),(10.,10.),(0.,10.)],true);assert_eq!(a.area(),100.);assert_eq!(a.length(),40.);}
#[test] fn parser_rejects_truncated_or_nan(){assert!(process(&[0.01,0.,0.,1.,0.,2.,0.,0.]).is_err());assert!(process(&[f64::NAN,0.,0.,0.]).is_err());}
#[test] fn abi_result_is_json(){let s=process(&[0.01,0.,0.,1.,0.,2.,0.,0.,10.,10.]).unwrap();assert!(s.contains("\"kind\":\"open\""));}
